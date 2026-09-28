import { IsEmail, IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty()
  @IsString()
  fullName;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email;

  @ApiProperty({ example: 'janedoe' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\S+$/, { message: 'Username must not contain spaces' })
  username;

  @ApiProperty({ example: 'Pass@123', minLength: 5 })
  @IsString()
  @MinLength(5, { message: 'Password must be at least 5 characters' })
  @Matches(
    /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]).+$/,
    { message: 'Password must contain at least one letter, one number, and one special character' },
  )
  password;
}

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com or janedoe' })
  @IsNotEmpty()
  @IsString()
  identifier;

  @ApiProperty({ example: 'Pass@123' })
  @IsNotEmpty()
  @IsString()
  password;
}
