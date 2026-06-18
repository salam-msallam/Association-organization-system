import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Authentication') 
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK) 
  @ApiOperation({ summary: 'تسجيل دخول الأدمن والموظفين' })
  @ApiResponse({ status: 200, description: 'تم تسجيل الدخول بنجاح وعاد التوكن.' })
  @ApiResponse({ status: 401, description: 'البيانات المدخلة خاطئة.' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto);
    return this.authService.login(user);
  }
}