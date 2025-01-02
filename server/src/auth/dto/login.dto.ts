import { IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  user: string;
  @IsNotEmpty()
  password: string;
}
