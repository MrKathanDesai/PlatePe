import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'fallback_dev_secret',
    });
  }

  async validate(payload: { sub: string; phone: string; type: string }) {
    if (payload.type !== 'customer') throw new UnauthorizedException();
    const customer = await this.customerRepo.findOne({ where: { id: payload.sub } });
    if (!customer) throw new UnauthorizedException();
    return customer;
  }
}
