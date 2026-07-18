package portalauth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const claimsKey = "portal-claims"

type Claims struct {
	Subject string
	Name    string
	Roles   []string
	Flatten map[string]any
}

type Validator struct {
	keys map[string]any
}

type jwk struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type jwksDocument struct {
	Keys []jwk `json:"keys"`
}

func NewValidatorFromEnv() (*Validator, error) {
	url := strings.TrimSpace(os.Getenv("MINSTACK_JWKS_URL"))
	if url == "" {
		return nil, errors.New("MINSTACK_JWKS_URL is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	keys, err := loadJWKS(ctx, url)
	if err != nil {
		return nil, err
	}

	return &Validator{keys: keys}, nil
}

func loadJWKS(ctx context.Context, url string) (map[string]any, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("fetch JWKS: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("JWKS endpoint returned %d", response.StatusCode)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	var document jwksDocument
	if err := json.Unmarshal(body, &document); err != nil {
		return nil, fmt.Errorf("parse JWKS: %w", err)
	}
	if len(document.Keys) == 0 {
		return nil, errors.New("JWKS contains no keys")
	}

	keys := make(map[string]any, len(document.Keys))
	for _, key := range document.Keys {
		publicKey, err := parseJWK(key)
		if err != nil {
			return nil, err
		}
		if key.Kid != "" {
			keys[key.Kid] = publicKey
		} else {
			keys["default"] = publicKey
		}
	}

	return keys, nil
}

func parseJWK(key jwk) (any, error) {
	switch key.Kty {
	case "RSA":
		nBytes, err := base64.RawURLEncoding.DecodeString(key.N)
		if err != nil {
			return nil, fmt.Errorf("decode RSA n: %w", err)
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(key.E)
		if err != nil {
			return nil, fmt.Errorf("decode RSA e: %w", err)
		}
		return &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: int(new(big.Int).SetBytes(eBytes).Int64()),
		}, nil
	case "EC":
		xBytes, err := base64.RawURLEncoding.DecodeString(key.X)
		if err != nil {
			return nil, fmt.Errorf("decode EC x: %w", err)
		}
		yBytes, err := base64.RawURLEncoding.DecodeString(key.Y)
		if err != nil {
			return nil, fmt.Errorf("decode EC y: %w", err)
		}

		curve := elliptic.P256()
		if key.Crv != "" && key.Crv != "P-256" {
			return nil, fmt.Errorf("unsupported EC curve %q", key.Crv)
		}

		return &ecdsa.PublicKey{
			Curve: curve,
			X:     new(big.Int).SetBytes(xBytes),
			Y:     new(big.Int).SetBytes(yBytes),
		}, nil
	default:
		return nil, fmt.Errorf("unsupported key type %q", key.Kty)
	}
}

func (v *Validator) Validate(tokenString string) (*Claims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		if kid, ok := token.Header["kid"].(string); ok && kid != "" {
			if key, exists := v.keys[kid]; exists {
				return key, nil
			}
		}
		for _, key := range v.keys {
			return key, nil
		}
		return nil, errors.New("no matching JWKS key")
	}, jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg(), jwt.SigningMethodES256.Alg()}))
	if err != nil {
		return nil, err
	}

	claimsMap, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	claims := &Claims{}
	if subject, ok := claimsMap["sub"].(string); ok {
		claims.Subject = subject
	}
	if name, ok := claimsMap["name"].(string); ok {
		claims.Name = name
	}
	if rawRoles, ok := claimsMap["roles"].([]any); ok {
		for _, role := range rawRoles {
			if value, ok := role.(string); ok {
				claims.Roles = append(claims.Roles, value)
			}
		}
	}

	reserved := map[string]bool{
		"sub": true, "iss": true, "aud": true,
		"exp": true, "nbf": true, "iat": true, "jti": true,
		"name": true, "roles": true,
	}
	for key, value := range claimsMap {
		if reserved[key] {
			continue
		}
		if claims.Flatten == nil {
			claims.Flatten = make(map[string]any)
		}
		claims.Flatten[key] = value
	}

	return claims, nil
}

func Authenticate(validator *Validator) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		header := ctx.GetHeader("Authorization")
		if header == "" {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or malformed Authorization header"})
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or malformed Authorization header"})
			return
		}

		claims, err := validator.Validate(parts[1])
		if err != nil {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		ctx.Set(claimsKey, claims)
		ctx.Next()
	}
}

func ClaimsFromContext(ctx *gin.Context) (*Claims, bool) {
	value, ok := ctx.Get(claimsKey)
	if !ok {
		return nil, false
	}
	claims, ok := value.(*Claims)
	return claims, ok
}
