import { NextRequest, NextResponse } from 'next/server';
import { tokenCostMonitor } from '../../services/tokenCostMonitor';

/**
 * Token Usage API
 * Monitor LLM token consumption and costs
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    if (detailed) {
      // Return detailed usage statistics
      const stats = tokenCostMonitor.getUsageStats();
      
      return NextResponse.json({
        totalCostUsd: stats.totalCostUsd,
        monthlyUsage: stats.monthlyUsage,
        supportedModels: stats.supportedModels,
        costRates: stats.costRates,
        formatters: {
          totalCostFormatted: tokenCostMonitor.formatCost(stats.totalCostUsd),
          monthlyUsageFormatted: Object.fromEntries(
            Object.entries(stats.monthlyUsage).map(([model, cost]) => [
              model, 
              tokenCostMonitor.formatCost(cost)
            ])
          )
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // Return summary statistics
      const totalCost = tokenCostMonitor.getTotalCost();
      const monthlyUsage = tokenCostMonitor.getMonthlyUsage();
      
      return NextResponse.json({
        totalCostUsd: totalCost,
        totalCostFormatted: tokenCostMonitor.formatCost(totalCost),
        monthlyUsage,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error fetching token usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token usage' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'reset':
        // Reset usage statistics (for testing)
        tokenCostMonitor.reset();
        return NextResponse.json({ 
          message: 'Token usage statistics reset',
          timestamp: new Date().toISOString()
        });

      case 'check_budget':
        // Check if daily budget is exceeded
        const dailyBudget = parseFloat(body.dailyBudgetUsd || '10');
        const exceeded = tokenCostMonitor.checkBudgetAlert(dailyBudget);
        
        return NextResponse.json({
          budgetExceeded: exceeded,
          dailyBudgetUsd: dailyBudget,
          currentCost: tokenCostMonitor.getTotalCost(),
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: reset, check_budget' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing token usage request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}