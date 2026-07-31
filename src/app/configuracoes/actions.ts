'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { parseInteger, parseNumber } from '@/lib/format';
import type { VolumeBand } from '@/lib/pricing/types';

function num(form: FormData, key: string): number {
  return parseNumber(form.get(key) as string);
}
/** Read a percentage field entered as whole number (40 -> 0.40). */
function pct(form: FormData, key: string): number {
  return num(form, key) / 100;
}

function revalidateAll() {
  revalidatePath('/configuracoes/especialidades');
  revalidatePath('/configuracoes/pacotes');
  revalidatePath('/configuracoes/parametros');
  revalidatePath('/simulador');
  revalidatePath('/calculadora-reversa');
  revalidatePath('/');
}

// --------------------------- Specialties ---------------------------

export async function saveSpecialty(form: FormData) {
  const id = (form.get('id') as string) || undefined;
  const allowsDouble = form.get('allowsDouble') === 'on';
  const longShare = allowsDouble ? pct(form, 'realLongShare') : 0;
  const data = {
    name: (form.get('name') as string).trim(),
    costPerCredit: num(form, 'costPerCredit'),
    creditDurationMin: Math.round(num(form, 'creditDurationMin')),
    allowsDouble,
    realLongShare: longShare,
    realShortShare: 1 - longShare,
  };
  if (id) {
    await prisma.specialty.update({ where: { id }, data });
  } else {
    await prisma.specialty.create({ data });
  }
  revalidateAll();
}

export async function deleteSpecialty(form: FormData) {
  const id = form.get('id') as string;
  await prisma.specialty.delete({ where: { id } });
  revalidateAll();
}

// --------------------------- Packages ---------------------------

export async function savePackage(form: FormData) {
  const id = (form.get('id') as string) || undefined;
  const name = (form.get('name') as string).trim();
  const recurrence = num(form, 'recurrence');

  // Specialty lines come as arrays: specialtyId[], mixShare[] (percent), credits[]
  const specialtyIds = form.getAll('specialtyId') as string[];
  const mixShares = form.getAll('mixShare') as string[];
  const credits = form.getAll('contractedCredits') as string[];

  const lines = specialtyIds
    .map((specialtyId, i) => ({
      specialtyId,
      mixShare: parseNumber(mixShares[i]) / 100,
      contractedCredits: parseNumber(credits[i]),
    }))
    .filter((l) => l.specialtyId && l.mixShare > 0);

  if (id) {
    await prisma.$transaction([
      prisma.package.update({ where: { id }, data: { name, recurrence } }),
      prisma.packageSpecialty.deleteMany({ where: { packageId: id } }),
      prisma.packageSpecialty.createMany({
        data: lines.map((l) => ({ ...l, packageId: id })),
      }),
    ]);
  } else {
    await prisma.package.create({
      data: { name, recurrence, specialties: { create: lines } },
    });
  }
  revalidateAll();
}

export async function deletePackage(form: FormData) {
  const id = form.get('id') as string;
  await prisma.package.delete({ where: { id } });
  revalidateAll();
}

// --------------------------- Global config ---------------------------

export async function saveConfig(form: FormData) {
  // Each utilization band is its own field (avoids the comma-as-separator vs
  // comma-as-decimal conflict). Values are entered as percentages.
  const utilizationBands = (form.getAll('utilBand') as string[])
    .map((s) => parseNumber(s) / 100)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  const volMax = form.getAll('volMaxLives') as string[];
  const volDisc = form.getAll('volDiscount') as string[];
  const volLabel = form.getAll('volLabel') as string[];
  const volumeBands: VolumeBand[] = volMax
    .map((maxRaw, i) => {
      const trimmed = (maxRaw ?? '').trim();
      const maxLives = trimmed === '' ? null : parseInteger(trimmed);
      return {
        maxLives,
        discountPct: parseNumber(volDisc[i]) / 100,
        label: (volLabel[i] ?? '').trim() || undefined,
      };
    })
    .filter((b, i) => (volMax[i] ?? '').trim() !== '' || (volLabel[i] ?? '').trim() !== '' || b.discountPct > 0);

  const data = {
    targetMargin: pct(form, 'targetMargin'),
    taxRate: pct(form, 'taxRate'),
    noShowRate: pct(form, 'noShowRate'),
    noShowRepassePct: pct(form, 'noShowRepassePct'),
    utilizationBands: JSON.stringify(utilizationBands),
    volumeBands: JSON.stringify(volumeBands),
  };

  await prisma.globalConfig.upsert({
    where: { id: 'global' },
    update: data,
    create: { id: 'global', ...data },
  });
  revalidateAll();
}
