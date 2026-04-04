import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KDSController } from './kds.controller';
import { KDSService } from './kds.service';
import { KDSGateway } from './kds.gateway';
import { KDSTicket } from './entities/kds-ticket.entity';
import { OrderLineItem } from '../orders/entities/order-line-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Table } from '../tables/entities/table.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KDSTicket, OrderLineItem, Order, Table])],
  controllers: [KDSController],
  providers: [KDSService, KDSGateway],
  exports: [KDSService, KDSGateway],
})
export class KDSModule {}
