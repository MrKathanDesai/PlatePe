import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const userCount = await this.userRepo.count();
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      // First user becomes Admin automatically
      role: (userCount === 0 ? 'Admin' : (dto.role ?? 'Server')) as UserRole,
    });

    await this.userRepo.save(user);
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email, isActive: true } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    const { passwordHash: _, ...userResult } = user;
    return { accessToken, user: userResult };
  }

  async findAll() {
    return this.userRepo.find({
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'],
    });
  }

  async deactivate(id: string) {
    await this.userRepo.update(id, { isActive: false });
    return { message: 'User deactivated' };
  }

  async reactivate(id: string) {
    await this.userRepo.update(id, { isActive: true });
    return { message: 'User reactivated' };
  }

  async updateRole(id: string, role: UserRole) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update(id, { role });
    return { message: 'Role updated' };
  }

  async remove(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.delete(id);
    return { message: 'User deleted' };
  }
}
