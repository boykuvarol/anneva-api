import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'anneva-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('users')
  createUser(@Body() body: { email: string; name?: string }) {
    return this.prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
      },
    });
  }

  @Get('users')
  getUsers() {
    return this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
