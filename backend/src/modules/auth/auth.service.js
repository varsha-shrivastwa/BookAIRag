import { Injectable, Logger, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { CREATE_USERS_TABLE } from './entities/user.schema.js';

@Injectable()
export class AuthService {
  constructor(configService) {
    this.configService = configService;
    this.logger = new Logger(AuthService.name);

    const connectionString =
      this.configService.get('DATABASE_URL') ||
      'postgresql://raguser:ragpass@localhost:5432/book_rag_db';
    this.pool = new Pool({ connectionString });

    this.jwtSecret = this.configService.get('JWT_SECRET') || 'bookai_jwt_secret';
    this.jwtExpiresIn = this.configService.get('JWT_EXPIRES_IN') || '7d';
  }

  async onModuleInit() {
    try {
      await this.pool.query(CREATE_USERS_TABLE);
      this.logger.log('Users table initialized.');
    } catch (error) {
      this.logger.warn(`Could not initialize users table: ${error.message}`);
    }
  }

  _validateRegistration({ fullName, email, username, password }) {
    const errors = [];

    if (!fullName || !fullName.trim())
      errors.push('Full name is required.');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push('A valid email address is required.');

    if (!username || !username.trim())
      errors.push('Username is required.');
    else if (/\s/.test(username))
      errors.push('Username must not contain spaces.');

    if (!password || password.length < 5)
      errors.push('Password must be at least 5 characters.');
    else if (!/[a-zA-Z]/.test(password))
      errors.push('Password must contain at least one letter.');
    else if (!/[0-9]/.test(password))
      errors.push('Password must contain at least one number.');
    else if (!/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(password))
      errors.push('Password must contain at least one special character.');

    if (errors.length > 0)
      throw new BadRequestException(errors.join(' '));
  }

  async register({ fullName, email, username, password }) {
    // Validate inputs
    this._validateRegistration({ fullName, email, username, password });

    // Check email uniqueness
    const emailCheck = await this.pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email],
    );
    if (emailCheck.rows.length > 0) {
      throw new ConflictException('Email is already registered');
    }

    // Check username uniqueness
    const usernameCheck = await this.pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username],
    );
    if (usernameCheck.rows.length > 0) {
      throw new ConflictException('Username is already taken');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await this.pool.query(
      `INSERT INTO users (full_name, email, username, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, username, created_at`,
      [fullName, email.toLowerCase(), username.toLowerCase(), passwordHash],
    );

    const user = result.rows[0];
    const token = this._signToken(user);

    return {
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        username: user.username,
      },
    };
  }

  async login({ identifier, password }) {
    const result = await this.pool.query(
      `SELECT id, full_name, email, username, password_hash
       FROM users
       WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)`,
      [identifier],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this._signToken(user);

    return {
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        username: user.username,
      },
    };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  _signToken(user) {
    return jwt.sign(
      { sub: user.id, email: user.email, username: user.username, fullName: user.full_name },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn },
    );
  }
}

Reflect.defineMetadata('design:paramtypes', [ConfigService], AuthService);
