import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: any) {
    // Guards handle redirection
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { access_token, user } = await this.authService.googleLogin(req);

    // Store JWT in an HTTP-only cookie
    res.cookie('jwt', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return a script that communicates with the main window and closes the popup
    return res.send(`
      <html>
        <body style="background: #000; color: #fff; display: flex; align-items: center; justify-center: center; height: 100vh; font-family: sans-serif;">
          <div style="text-align: center;">
            <h2 style="color: #d4af37;">AUTHENTICATED</h2>
            <p>Closing window...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'AUTH_SUCCESS', 
                user: ${JSON.stringify(user)} 
              }, "*");
              window.close();
            } else {
              window.location.href = "${process.env.FRONTEND_URL || 'http://localhost:3002'}";
            }
          </script>
        </body>
      </html>
    `);
  }

  @Get('me')
  async getProfile(@Req() req: Request) {
    const token = req.cookies?.['jwt'];
    if (!token) throw new UnauthorizedException('Not authenticated');

    const payload = await this.authService.verifyToken(token);
    const user = await this.authService.getFullUser(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  @Post('profile/username')
  async updateUsername(
    @Req() req: Request,
    @Body() body: { username: string },
  ) {
    const token = req.cookies?.['jwt'];
    if (!token) throw new UnauthorizedException('Not authenticated');

    const payload = await this.authService.verifyToken(token);
    return await this.authService.updateUsername(payload.sub, body.username);
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }

  @Post('email/send-otp')
  async sendOtp(@Body() body: { email: string }) {
    return this.authService.sendOtp(body.email);
  }

  @Post('email/verify-otp')
  async verifyOtp(
    @Body() body: { email: string; code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, user } = await this.authService.verifyOtp(
      body.email,
      body.code,
    );

    res.cookie('jwt', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { user };
  }
}
