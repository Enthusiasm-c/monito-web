import React from 'react';
import { SupplierManagementClient } from './SupplierManagementClient';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

interface SupplierManagePageProps {
  params: {
    id: string;
  };
}

export default async function SupplierManagePage({ params }: SupplierManagePageProps) {
  // Fetch supplier data
  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
    include: {
      _count: {
        select: {
          prices: true,
          uploads: true
        }
      }
    }
  });

  if (!supplier) {
    notFound();
  }

  // Fetch recent price data for overview
  const recentPrices = await prisma.price.findMany({
    where: { supplierId: params.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          standardizedName: true,
          category: true,
          unit: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  // Fetch price statistics
  const priceStats = await prisma.price.aggregate({
    where: { supplierId: params.id },
    _avg: { amount: true },
    _min: { amount: true },
    _max: { amount: true },
    _count: true
  });

  // Format data for client component
  const supplierData = {
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    contactInfo: supplier.contactInfo,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    _count: supplier._count
  };

  const formattedPrices = recentPrices.map(price => ({
    id: price.id,
    amount: parseFloat(price.amount.toString()),
    unit: price.unit,
    unitPrice: price.unitPrice ? parseFloat(price.unitPrice.toString()) : null,
    validFrom: price.validFrom,
    validTo: price.validTo,
    createdAt: price.createdAt,
    product: price.product
  }));

  const statsData = {
    totalPrices: priceStats._count,
    averagePrice: priceStats._avg.amount ? parseFloat(priceStats._avg.amount.toString()) : 0,
    minPrice: priceStats._min.amount ? parseFloat(priceStats._min.amount.toString()) : 0,
    maxPrice: priceStats._max.amount ? parseFloat(priceStats._max.amount.toString()) : 0
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SupplierManagementClient 
        supplier={supplierData}
        recentPrices={formattedPrices}
        priceStats={statsData}
      />
    </div>
  );
}

export async function generateMetadata({ params }: SupplierManagePageProps) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
    select: { name: true }
  });

  return {
    title: supplier ? `Manage ${supplier.name} | Admin` : 'Supplier Not Found | Admin',
    description: `Manage prices, uploads, and settings for ${supplier?.name || 'supplier'}`
  };
}