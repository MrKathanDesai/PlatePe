import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderTokensController } from './order-tokens.controller';
import { OrderTokensService } from './order-tokens.service';
import { OrderToken } from './entities/order-token.entity';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrderToken, Order])],
  controllers: [OrderTokensController],
  providers: [OrderTokensService],
  exports: [OrderTokensService],
})
export class OrderTokensModule {}
