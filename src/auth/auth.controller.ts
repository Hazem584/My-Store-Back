import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { GetUser } from './decorators/get-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import type { JwtPayload } from './types/jwt-payload.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@GetUser() user: JwtPayload, @Body() dto: LogoutDto) {
    return this.authService.logout(user.sub, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@GetUser() user: JwtPayload) {
    return { user };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Get('admin-only')
  adminOnly(@GetUser() user: JwtPayload) {
    return {
      message: 'OWNER access granted',
      user,
    };
  }
}
