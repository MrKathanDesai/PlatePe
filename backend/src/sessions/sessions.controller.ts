import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // --- Terminals ---
  @Post('terminals')
  @Roles('Admin')
  createTerminal(@Body() dto: CreateTerminalDto) {
    return this.sessionsService.createTerminal(dto);
  }

  @Get('terminals')
  findAllTerminals() {
    return this.sessionsService.findAllTerminals();
  }

  // --- Sessions ---
  @Post('sessions/open')
  openSession(@Body() dto: OpenSessionDto, @CurrentUser() user: User) {
    return this.sessionsService.openSession(dto, user);
  }

  @Get('sessions/active')
  getActiveSession(@CurrentUser() user: User) {
    return this.sessionsService.getActiveSession(user.id);
  }

  @Post('sessions/:id/close')
  closeSession(
    @Param('id') id: string,
    @Body() dto: CloseSessionDto,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.closeSession(id, dto, user.id);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.sessionsService.getSession(id);
  }

  @Get('sessions')
  @Roles('Admin')
  getSessionHistory() {
    return this.sessionsService.getSessionHistory();
  }
}
