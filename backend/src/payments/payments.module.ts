import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderLineItem } from '../orders/entities/order-line-item.entity';
import { Table } from '../tables/entities/table.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { KDSModule } from '../kds/kds.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order, OrderLineItem, Table, AuditLog]),
    KDSModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
