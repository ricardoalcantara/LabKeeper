import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { REPOSITORIES } from 'src/database/database.constants';
import { UserRepository } from 'src/database/repositories';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/database/models/user.model';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;

  const hashedPassword: string = bcrypt.hashSync('admin', 10);

  const mockUser = {
    id: 1,
    email: 'admin@example.com',
    username: 'admin',
    password: hashedPassword,
    name: 'Admin',
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: REPOSITORIES.USER_REPOSITORY,
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(REPOSITORIES.USER_REPOSITORY);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('loginAsync', () => {
    describe('login with username', () => {
      const loginDto: LoginDto = {
        user: 'admin',
        password: 'admin',
      };

      it('should throw UnauthorizedException when user is not found', async () => {
        userRepository.findByUsername.mockResolvedValue(null);
        userRepository.findByEmail.mockResolvedValue(null);

        await expect(service.loginAsync(loginDto)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should return access token when credentials are correct', async () => {
        userRepository.findByUsername.mockResolvedValue(mockUser as User);
        jest.spyOn(bcrypt, 'compare');

        const result = await service.loginAsync(loginDto);

        expect(result).toHaveProperty('accessToken');
        expect(result.accessToken).toBe('mock.jwt.token');
        expect(userRepository.findByUsername).toHaveBeenCalledWith(
          loginDto.user,
        );
      });
    });

    describe('login with email', () => {
      const loginDto: LoginDto = {
        user: 'admin@example.com',
        password: 'admin',
      };

      it('should find user by email when input contains @', async () => {
        userRepository.findByEmail.mockResolvedValue(mockUser as User);

        await service.loginAsync(loginDto);

        expect(userRepository.findByEmail).toHaveBeenCalledWith(loginDto.user);
        expect(userRepository.findByUsername).not.toHaveBeenCalled();
      });

      it('should throw UnauthorizedException when user is not found', async () => {
        userRepository.findByEmail.mockResolvedValue(null);

        await expect(service.loginAsync(loginDto)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });

    describe('password verification', () => {
      it('should throw UnauthorizedException when password is incorrect', async () => {
        const loginDto: LoginDto = {
          user: 'admin',
          password: 'admin00',
        };

        userRepository.findByUsername.mockResolvedValue(mockUser as User);

        await expect(service.loginAsync(loginDto)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should verify password using bcrypt', async () => {
        const loginDto: LoginDto = {
          user: 'admin',
          password: 'admin',
        };

        userRepository.findByUsername.mockResolvedValue(mockUser as User);
        const compareSpy = jest.spyOn(bcrypt, 'compare');

        await service.loginAsync(loginDto);

        expect(compareSpy).toHaveBeenCalledWith(
          loginDto.password,
          mockUser.password,
        );
      });
    });

    describe('JWT token generation', () => {
      const loginDto: LoginDto = {
        user: 'admin',
        password: 'admin',
      };

      it('should generate JWT token with correct payload', async () => {
        userRepository.findByUsername.mockResolvedValue(mockUser as User);
        await service.loginAsync(loginDto);

        expect(jwtService.signAsync).toHaveBeenCalledWith({
          sub: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
        });
      });
    });

    describe('security considerations', () => {
      it('should return the same error message for non-existent user and wrong password', async () => {
        userRepository.findByUsername.mockResolvedValue(null);
        await expect(
          service.loginAsync({ user: 'nonexistent', password: 'anypassword' }),
        ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));

        const loginDto: LoginDto = {
          user: 'nonexistent',
          password: 'anypassword',
        };
        userRepository.findByUsername.mockResolvedValue(mockUser as User);
        await expect(service.loginAsync(loginDto)).rejects.toThrow(
          new UnauthorizedException('Invalid credentials'),
        );
      });
    });
  });
});
