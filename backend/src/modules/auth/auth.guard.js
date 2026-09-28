import { CanActivate, ExecutionContext, UnauthorizedException, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Injectable()
export class AuthGuard {
  constructor(authService) {
    this.authService = authService;
  }

  canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const payload = this.authService.verifyToken(token);
    request.user = payload;
    return true;
  }
}

Reflect.defineMetadata('design:paramtypes', [AuthService], AuthGuard);
