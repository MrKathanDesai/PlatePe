import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderLineItem } from './entities/order-line-item.entity';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Table } from '../tables/entities/table.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { KDSTicket } from '../kds/entities/kds-ticket.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderLineItem, Product, Category, Table, AuditLog, KDSTicket]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
