package discovery

import (
	"net"
	"net/netip"
)

// Network is a private IPv4 interface address and its CIDR.
type Network struct {
	Iface   string `json:"iface"`
	CIDR    string `json:"cidr"`
	Address string `json:"address"`
}

func isPrivateIPv4(ip netip.Addr) bool {
	if !ip.Is4() || !ip.IsValid() {
		return false
	}
	return ip.IsPrivate()
}

func listPrivateNetworks() ([]Network, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	out := make([]Network, 0)
	seen := make(map[string]struct{})

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			prefix, ok := prefixFromAddr(addr)
			if !ok || !isPrivateIPv4(prefix.Addr()) {
				continue
			}
			masked := prefix.Masked()
			key := iface.Name + "|" + masked.String()
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			out = append(out, Network{
				Iface:   iface.Name,
				CIDR:    masked.String(),
				Address: prefix.Addr().String(),
			})
		}
	}
	return out, nil
}

func prefixFromAddr(addr net.Addr) (netip.Prefix, bool) {
	switch v := addr.(type) {
	case *net.IPNet:
		ip, ok := netip.AddrFromSlice(v.IP.To4())
		if !ok {
			ip, ok = netip.AddrFromSlice(v.IP)
			if !ok || !ip.Is4() {
				return netip.Prefix{}, false
			}
		}
		ones, bits := v.Mask.Size()
		if bits != 32 {
			return netip.Prefix{}, false
		}
		return netip.PrefixFrom(ip, ones), true
	default:
		return netip.Prefix{}, false
	}
}
