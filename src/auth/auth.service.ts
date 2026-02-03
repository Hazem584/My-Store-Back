import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_CONSTANTS } from '../common/constants/auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';

export type SafeUser = Pick<
  User,
  'id' | 'fullName' | 'email' | 'role' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.getBcryptRounds(),
    );

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email,
        passwordHash,
        role: dto.role ?? Role.CASHIER,
      },
      select: this.safeUserSelect(),
    });

    const tokens = await this.issueTokens(user);

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...this.safeUserSelect(),
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash, ...safeUser } = user;
    const tokens = await this.issueTokens(safeUser);

    return {
      user: safeUser,
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: this.safeUserSelect(),
    });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenRecord = await this.findRefreshTokenRecord(
      payload.sub,
      refreshToken,
    );

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });

    const tokens = await this.issueTokens(user);

    return {
      user,
      ...tokens,
    };
  }

  async logout(userId: string, refreshToken: string) {
    let payload: JwtPayload | null = null;

    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch {
      return { success: true };
    }

    if (payload.sub !== userId) {
      return { success: true };
    }

    const tokenRecord = await this.findRefreshTokenRecord(
      payload.sub,
      refreshToken,
    );

    if (tokenRecord) {
      await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
    }

    return { success: true };
  }

  private async issueTokens(user: SafeUser) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.getAccessSecret(),
      expiresIn: this.getAccessExpiresIn(),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: this.getRefreshExpiresIn(),
    });

    const tokenHash = await bcrypt.hash(refreshToken, this.getBcryptRounds());
    const expiresAt = new Date(Date.now() + this.getRefreshExpiresMs());

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async findRefreshTokenRecord(userId: string, refreshToken: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    });

    for (const token of tokens) {
      const matches = await bcrypt.compare(refreshToken, token.tokenHash);
      if (matches) {
        return token;
      }
    }

    return null;
  }

  private safeUserSelect() {
    return {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private getAccessSecret() {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private getRefreshSecret() {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private getAccessExpiresIn(): JwtSignOptions['expiresIn'] {
    return (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      AUTH_CONSTANTS.accessTokenExpiresIn) as JwtSignOptions['expiresIn'];
  }

  private getRefreshExpiresIn(): JwtSignOptions['expiresIn'] {
    return (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      AUTH_CONSTANTS.refreshTokenExpiresIn) as JwtSignOptions['expiresIn'];
  }

  private getRefreshExpiresMs() {
    return parseDurationToMs(
      this.getRefreshExpiresIn(),
      7 * 24 * 60 * 60 * 1000,
    );
  }

  private getBcryptRounds() {
    const rounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS');
    return rounds ?? AUTH_CONSTANTS.bcryptSaltRounds;
  }
}

function parseDurationToMs(
  value: JwtSignOptions['expiresIn'],
  fallbackMs: number,
) {
  if (typeof value === 'number') {
    return value * 1000;
  }

  const trimmed = value?.trim();
  if (!trimmed) {
    return fallbackMs;
  }

  const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(trimmed);
  if (!match) {
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed) * 1000;
    }
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
}
