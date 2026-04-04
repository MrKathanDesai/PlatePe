import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerJwtStrategy } from './customer-jwt.strategy';
import { FirebaseService } from './firebase.service';

import { Customer } from './entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Table } from '../tables/entities/table.entity';
import { Session } from '../sessions/entities/session.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderLineItem } from '../orders/entities/order-line-item.entity';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      Product,
      Category,
      Table,
      Session,
      Order,
      OrderLineItem,
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'fallback_dev_secret',
        signOptions: { expiresIn: '24h' },
      }),
    }),
    PaymentsModule,
    OrdersModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerJwtStrategy, FirebaseService],
})
export class CustomerModule {}
