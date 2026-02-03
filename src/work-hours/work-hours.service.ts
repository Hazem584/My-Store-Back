import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkDayDto } from './dto/create-work-day.dto';
import { QueryMonthlyWorkHoursDto } from './dto/query-monthly-work-hours.dto';
import { QueryWorkDayDto } from './dto/query-work-day.dto';

@Injectable()
export class WorkHoursService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, dto: CreateWorkDayDto) {
    const date = parseDate(dto.date);
    const shifts = parseShifts(date, dto);

    const totalMinutes =
      minutesDiff(shifts.shift1Start, shifts.shift1End) +
      minutesDiff(shifts.shift2Start, shifts.shift2End);

    return this.prisma.workDay.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      update: {
        ...shifts,
        totalMinutes,
      },
      create: {
        userId,
        date,
        ...shifts,
        totalMinutes,
      },
    });
  }

  async getByDate(userId: string, role: string, query: QueryWorkDayDto) {
    const date = parseDate(query.date);
    const where: Prisma.WorkDayWhereInput = { date };

    if (role === 'CASHIER') {
      where.userId = userId;
    } else if (query.userId) {
      where.userId = query.userId;
    }

    const data = await this.prisma.workDay.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { userId: 'asc' },
    });

    return { data };
  }

  async getMonthly(query: QueryMonthlyWorkHoursDto) {
    const { start, end, label } = parseMonthRange(query.month);

    const [byUser, byDay] = await Promise.all([
      this.prisma.workDay.groupBy({
        by: ['userId'],
        where: { date: { gte: start, lte: end } },
        _sum: { totalMinutes: true },
      }),
      this.prisma.workDay.groupBy({
        by: ['date'],
        where: { date: { gte: start, lte: end } },
        _sum: { totalMinutes: true },
      }),
    ]);

    const userIds = byUser.map((row) => row.userId);
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    const totalsByUser = byUser
      .map((row) => {
        const user = userMap.get(row.userId);
        return {
          userId: row.userId,
          fullName: user?.fullName ?? 'Unknown',
          email: user?.email ?? null,
          totalMinutes: row._sum.totalMinutes ?? 0,
        };
      })
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    const totalsByDay = byDay
      .map((row) => ({
        date: formatDate(row.date),
        totalMinutes: row._sum.totalMinutes ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      month: label,
      totalsByUser,
      totalsByDay,
    };
  }
}

function parseDate(input: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) {
    throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!isValidDateParts(year, month, day)) {
    throw new BadRequestException('Invalid date value.');
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function parseShifts(date: Date, dto: CreateWorkDayDto) {
  const shift1Start = parseTime(date, dto.shift1Start);
  const shift1End = parseTime(date, dto.shift1End);
  const shift2Start = parseTime(date, dto.shift2Start);
  const shift2End = parseTime(date, dto.shift2End);

  if ((shift1Start && !shift1End) || (!shift1Start && shift1End)) {
    throw new BadRequestException('Shift 1 start and end must both be provided.');
  }

  if ((shift2Start && !shift2End) || (!shift2Start && shift2End)) {
    throw new BadRequestException('Shift 2 start and end must both be provided.');
  }

  if (shift1Start && shift1End && shift1End <= shift1Start) {
    throw new BadRequestException('Shift 1 end must be after start.');
  }

  if (shift2Start && shift2End && shift2End <= shift2Start) {
    throw new BadRequestException('Shift 2 end must be after start.');
  }

  return {
    shift1Start,
    shift1End,
    shift2Start,
    shift2End,
  };
}

function parseTime(date: Date, value?: string) {
  if (!value) {
    return null;
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    throw new BadRequestException('Invalid time format. Use HH:mm.');
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
}

function minutesDiff(start: Date | null, end: Date | null) {
  if (!start || !end) {
    return 0;
  }

  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function parseMonthRange(monthInput?: string) {
  if (monthInput) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthInput.trim());
    if (!match) {
      throw new BadRequestException('Invalid month format. Use YYYY-MM.');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (!isValidMonth(year, month)) {
      throw new BadRequestException('Invalid month value.');
    }

    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    return { start, end, label: monthInput.trim() };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  return { start, end, label: formatMonth(year, month) };
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonth(year: number, month: number) {
  return `${year}-${pad(month)}`;
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function isValidDateParts(year: number, month: number, day: number) {
  if (!isValidMonth(year, month)) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isValidMonth(year: number, month: number) {
  return year >= 1970 && month >= 1 && month <= 12;
}
