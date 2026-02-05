/**
 * RewardSection Component Tests
 * 
 * @description Comprehensive test suite for RewardSection component
 * covering shop tab, inventory tab, reward purchase flow, and coupon states
 * @author Senior Test Engineer
 * @since 2024-02-04
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { RewardSection } from './RewardSection';
import { User, Reward, RedeemedReward } from '../../types';

// Mock child components
jest.mock('../RetroButton', () => ({
  RetroButton: ({ children, onClick, disabled, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      data-testid={props['data-testid']}
      className={props.className}
      {...props}
    >
      {children}
    </button>
  )
}));

jest.mock('../Skeleton', () => ({
  SkeletonGrid: ({ count }: any) => (
    <div data-testid="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} data-testid="skeleton-item">Loading...</div>
      ))}
    </div>
  ),
  SkeletonCard: () => <div data-testid="skeleton-card">Loading...</div>
}));

jest.mock('../EmptyState', () => ({
  EmptyState: ({ title, description, action, variant }: any) => (
    <div data-testid="empty-state" data-variant={variant}>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button data-testid="empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}));

describe('RewardSection', () => {
  // Test fixtures
  const mockUser: User = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    points: 500,
    wins: 10,
    gamesPlayed: 20,
    role: 'user',
    isAdmin: false,
    department: 'Bilgisayar Mühendisliği'
  };

  const mockRewards: Reward[] = [
    {
      id: 1,
      title: 'Türk Kahvesi',
      description: 'Geleneksel Türk kahvesi',
      cost: 100,
      icon: 'coffee'
    },
    {
      id: 2,
      title: 'Çay',
      description: 'Sıcak demli çay',
      cost: 50,
      icon: 'coffee'
    },
    {
      id: 3,
      title: 'Tatlı',
      description: 'Günün tatlısı',
      cost: 800, // Pahalı, kullanıcı alamaz
      icon: 'dessert'
    }
  ];

  const mockInventory: RedeemedReward[] = [
    {
      redeemId: 'ABC123',
      id: 1,
      title: 'Türk Kahvesi',
      description: 'Geleneksel Türk kahvesi',
      cost: 100,
      icon: 'coffee',
      code: 'ABC123',
      redeemedAt: new Date(),
      isUsed: false
    },
    {
      redeemId: 'DEF456',
      id: 2,
      title: 'Çay',
      description: 'Sıcak demli çay',
      cost: 50,
      icon: 'coffee',
      code: 'DEF456',
      redeemedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // Süresi dolmuş
      isUsed: false
    },
    {
      redeemId: 'GHI789',
      id: 3,
      title: 'Tatlı',
      description: 'Günün tatlısı',
      cost: 800,
      icon: 'dessert',
      code: 'GHI789',
      redeemedAt: new Date(),
      isUsed: true // Kullanılmış
    }
  ];

  // Mock handler'lar
  const mockHandlers = {
    onTabChange: jest.fn(),
    onBuyReward: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * SCENARIO 1: Tab Navigation
   */
  describe('Tab Navigation', () => {
    it('should display Shop tab by default', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      // Shop tab aktif görünüyor mu?
      const shopTab = screen.getByTestId('shop-tab');
      expect(shopTab).toHaveClass('bg-blue-500');
      expect(shopTab).toHaveTextContent('Mağaza');
      
      // Inventory tab görünüyor mu?
      const inventoryTab = screen.getByTestId('inventory-tab');
      expect(inventoryTab).toHaveTextContent(/Envanter/);
      expect(inventoryTab).toHaveTextContent(mockInventory.length.toString());
    });

    it('should switch to Inventory tab when clicked', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      const inventoryTab = screen.getByTestId('inventory-tab');
      fireEvent.click(inventoryTab);
      
      expect(mockHandlers.onTabChange).toHaveBeenCalledWith('inventory');
    });

    it('should switch to Shop tab when clicked from inventory', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="inventory"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      const shopTab = screen.getByTestId('shop-tab');
      fireEvent.click(shopTab);
      
      expect(mockHandlers.onTabChange).toHaveBeenCalledWith('shop');
    });

    it('should highlight active tab with correct styling', () => {
      const { rerender } = render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      // Shop aktif
      expect(screen.getByTestId('shop-tab')).toHaveClass('bg-blue-500');
      expect(screen.getByTestId('inventory-tab')).not.toHaveClass('bg-blue-500');

      // Inventory'e geç
      rerender(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="inventory"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      // Inventory aktif
      expect(screen.getByTestId('inventory-tab')).toHaveClass('bg-blue-500');
      expect(screen.getByTestId('shop-tab')).not.toHaveClass('bg-blue-500');
    });
  });

  /**
   * SCENARIO 2: User Points Display
   */
  describe('User Points Display', () => {
    it('should display current user points', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByText(/Bakiye:/i)).toBeInTheDocument();
      expect(screen.getByText(/500 puan/i)).toBeInTheDocument();
    });

    it('should update points display when user points change', () => {
      const { rerender } = render(
        <RewardSection
          currentUser={{ ...mockUser, points: 300 }}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByText(/300 puan/i)).toBeInTheDocument();

      rerender(
        <RewardSection
          currentUser={{ ...mockUser, points: 1000 }}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByText(/1000 puan/i)).toBeInTheDocument();
    });
  });

  /**
   * SCENARIO 3: Shop Tab - Loading State
   */
  describe('Shop Tab - Loading State', () => {
    it('should show skeleton when rewards are loading', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={[]}
          rewardsLoading={true}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByTestId('skeleton-grid')).toBeInTheDocument();
      const skeletonItems = screen.getAllByTestId('skeleton-item');
      expect(skeletonItems.length).toBeGreaterThan(0);
    });
  });

  /**
   * SCENARIO 4: Shop Tab - Empty State
   */
  describe('Shop Tab - Empty State', () => {
    it('should display empty state when no rewards available', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={[]}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/Mağaza Boş/i)).toBeInTheDocument();
      expect(screen.getByText(/satın alınabilecek ödül bulunmuyor/i)).toBeInTheDocument();
    });
  });

  /**
   * SCENARIO 5: Shop Tab - Reward List
   */
  describe('Shop Tab - Reward List', () => {
    it('should display all rewards with correct information', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      // Tüm ödüller görünüyor mu?
      expect(screen.getByText('Türk Kahvesi')).toBeInTheDocument();
      expect(screen.getByText('Çay')).toBeInTheDocument();
      expect(screen.getByText('Tatlı')).toBeInTheDocument();
      
      // Fiyatlar doğru mu?
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('800')).toBeInTheDocument();
    });

    it('should enable buy button for affordable rewards', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      // Alınabilir ödüller (100 ve 50 puan)
      const buyButtons = screen.getAllByTestId('shop-buy-button');
      expect(buyButtons[0]).not.toBeDisabled(); // Türk Kahvesi - 100 puan
      expect(buyButtons[1]).not.toBeDisabled(); // Çay - 50 puan
      expect(buyButtons[2]).toBeDisabled(); // Tatlı - 800 puan (pahalı)
    });

    it('should display "Yetersiz Puan" for unaffordable rewards', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByText(/Yetersiz Puan/i)).toBeInTheDocument();
    });

    it('should call onBuyReward when buy button clicked', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      const buyButtons = screen.getAllByTestId('shop-buy-button');
      fireEvent.click(buyButtons[0]); // Türk Kahvesi'ni al

      expect(mockHandlers.onBuyReward).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onBuyReward).toHaveBeenCalledWith(mockRewards[0]);
    });

    it('should not call onBuyReward for unaffordable rewards', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      const buyButtons = screen.getAllByTestId('shop-buy-button');
      
      // Tatlı (800 puan) butonu disabled, tıklanamaz
      expect(buyButtons[2]).toBeDisabled();
    });
  });

  /**
   * SCENARIO 6: Inventory Tab - Loading State
   */
  describe('Inventory Tab - Loading State', () => {
    it('should show skeleton when inventory is loading', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={[]}
          inventoryLoading={true}
          activeTab="inventory"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByTestId('skeleton-grid')).toBeInTheDocument();
    });
  });

  /**
   * SCENARIO 7: Inventory Tab - Empty State
   */
  describe('Inventory Tab - Empty State', () => {
    it('should display empty state when inventory is empty', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={[]}
          inventoryLoading={false}
          activeTab="inventory"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/Envanterin Boş/i)).toBeInTheDocument();
    });

    it('should navigate to shop from empty inventory', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={[]}
          inventoryLoading={false}
          activeTab="inventory"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      const actionButton = screen.getByTestId('empty-state-action');
      expect(actionButton).toHaveTextContent('Mağazaya Git');
      
      fireEvent.click(actionButton);
      expect(mockHandlers.onTabChange).toHaveBeenCalledWith('shop');
    });
  });

  /**
   * SCENARIO 8: Inventory Tab - Coupon Display
   */
  describe('Inventory Tab - Coupon Display', () => {
    it('should display all coupons with correct information', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="inventory"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      // Kupon kodları görünüyor mu?
      expect(screen.getByText('ABC123')).toBeInTheDocument();
      expect(screen.getByText('DEF456')).toBeInTheDocument();
      expect(screen.getByText('GHI789')).toBeInTheDocument();
      
      // Başlıklar görünüyor mu?
      expect(screen.getByText('Türk Kahvesi')).toBeInTheDocument();
      expect(screen.getByText('Çay')).toBeInTheDocument();
      expect(screen.getByText('Tatlı')).toBeInTheDocument();
    });

    it('should display "KULLANILDI" stamp for used coupons', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="inventory"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByText(/KULLANILDI/i)).toBeInTheDocument();
    });

    it('should display "SÜRESİ DOLDU" stamp for expired coupons', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="inventory"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByText(/SÜRESİ DOLDU/i)).toBeInTheDocument();
    });

    it('should display expiration date for valid coupons', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="inventory"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      // SKT (Son Kullanma Tarihi) görünüyor mu? (birden fazla olabilir)
      const sktElements = screen.getAllByText(/SKT:/i);
      expect(sktElements.length).toBeGreaterThan(0);
    });
  });

  /**
   * SCENARIO 9: Edge Cases
   */
  describe('Edge Cases', () => {
    it('should handle undefined rewards array', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={undefined as any}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      // BUG POTENTIAL: rewards.length check patlayabilir
      expect(document.body).toBeInTheDocument();
    });

    it('should handle undefined inventory array', () => {
      render(
        <RewardSection
          currentUser={mockUser}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={undefined as any}
          inventoryLoading={false}
          activeTab="inventory"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      // BUG POTENTIAL: inventory.length check patlayabilir
      expect(document.body).toBeInTheDocument();
    });

    it('should handle null currentUser', () => {
      render(
        <RewardSection
          currentUser={null as any}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      // BUG POTENTIAL: currentUser.points check patlayabilir
      expect(document.body).toBeInTheDocument();
    });

    it('should handle zero points user', () => {
      render(
        <RewardSection
          currentUser={{ ...mockUser, points: 0 }}
          rewards={mockRewards}
          rewardsLoading={false}
          inventory={mockInventory}
          inventoryLoading={false}
          activeTab="shop"
          onTabChange={mockHandlers.onTabChange}
          onBuyReward={mockHandlers.onBuyReward}
        />
      );

      expect(screen.getByText(/0 puan/i)).toBeInTheDocument();
      
      // Tüm butonlar disabled olmalı
      const buyButtons = screen.getAllByTestId('shop-buy-button');
      buyButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });
});
