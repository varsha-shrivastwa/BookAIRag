import { Controller, Post, Get, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { RegisterDto, LoginDto } from './auth.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  async register(@Body() body) {
    const { fullName, email, username, password } = body;
    return this.authService.register({ fullName, email, username, password });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/username and password' })
  async login(@Body() body) {
    const { identifier, password } = body;
    return this.authService.login({ identifier, password });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  me(@Req() req) {
    return { user: req.user };
  }
}

Reflect.defineMetadata('design:paramtypes', [AuthService], AuthController);
