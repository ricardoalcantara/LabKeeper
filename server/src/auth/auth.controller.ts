import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AccessToken } from './interface/access_token.interface';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() login: LoginDto): Promise<AccessToken> {
    return await this.authService.loginAsync(login);
  }
}
