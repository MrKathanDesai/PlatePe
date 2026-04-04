import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { Session } from './entities/session.entity';
import { Terminal } from './entities/terminal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Session, Terminal])],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
