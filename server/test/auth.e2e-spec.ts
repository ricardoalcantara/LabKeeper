import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  const mockAuthService = {
    loginAsync: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  it('should return 200 and access token on successful login', () => {
    const expectedResponse = {
      access_token: 'jwt.token.here',
    };

    mockAuthService.loginAsync.mockResolvedValue(expectedResponse);

    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        user: 'validuser',
        password: 'validpass',
      })
      .expect(200)
      .expect(expectedResponse);
  });

  it('should return 400 when login fields are empty', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        user: '',
        password: '',
      })
      .expect(400)
      .expect({
        statusCode: 400,
        error: 'Bad Request',
        message: ['user should not be empty', 'password should not be empty'],
      });
  });

  it('should return 400 when credentials are invalid', () => {
    mockAuthService.loginAsync.mockRejectedValue(
      new BadRequestException('Invalid credentials'),
    );

    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        user: 'wronguser',
        password: 'wrongpass',
      })
      .expect(400)
      .expect({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid credentials',
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
