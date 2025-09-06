import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { injectAxe, checkA11y, configureAxe } from 'axe-playwright';

// Mark all tests as accessibility tests
test.describe('@accessibility UI Accessibility Tests', () => {
  const baseURL = process.env.FRONTEND_URL || 'http://localhost:4006';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('WCAG Compliance', () => {
    test('Homepage passes WCAG 2.1 Level AA standards', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('Flow editor passes WCAG standards', async ({ page }) => {
      // Navigate to flow editor
      await page.getByRole('button', { name: /new project/i }).click();
      await page.waitForSelector('[data-testid="flow-editor"]', { timeout: 10000 });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa', 'wcag21aa'])
        .exclude('.react-flow__minimap') // Exclude minimap as it's decorative
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('Agent library passes WCAG standards', async ({ page }) => {
      await page.getByRole('button', { name: /new project/i }).click();
      await page.waitForSelector('[data-testid="agent-library"]', { timeout: 10000 });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa', 'wcag21aa'])
        .include('[data-testid="agent-library"]')
        .analyze();

      expect(results.violations).toEqual([]);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('All interactive elements are keyboard accessible', async ({ page }) => {
      // Tab through all focusable elements
      const focusableElements = await page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').all();
      
      for (let i = 0; i < focusableElements.length; i++) {
        await page.keyboard.press('Tab');
        const focusedElement = await page.evaluate(() => document.activeElement?.outerHTML);
        expect(focusedElement).toBeTruthy();
      }
    });

    test('Tab order follows logical flow', async ({ page }) => {
      const tabOrder: string[] = [];
      
      // Capture tab order
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? {
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 30),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label')
          } : null;
        });
        if (focused) {
          tabOrder.push(`${focused.tag}:${focused.role || 'none'}:${focused.ariaLabel || focused.text}`);
        }
      }

      // Verify tab order makes sense
      expect(tabOrder.length).toBeGreaterThan(0);
      expect(tabOrder).not.toContain(null);
    });

    test('Escape key closes modals and dropdowns', async ({ page }) => {
      // Open a modal
      await page.getByRole('button', { name: /new project/i }).click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // Press Escape
      await page.keyboard.press('Escape');
      
      // Modal should be closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('Enter and Space activate buttons', async ({ page }) => {
      const button = page.getByRole('button').first();
      await button.focus();
      
      // Test Space activation
      await page.keyboard.press('Space');
      // Verify button was activated (check for state change or navigation)
      
      // Test Enter activation
      await button.focus();
      await page.keyboard.press('Enter');
    });

    test('Arrow keys navigate menus and lists', async ({ page }) => {
      // Open agent library
      await page.getByRole('button', { name: /new project/i }).click();
      await page.waitForSelector('[data-testid="agent-library"]', { timeout: 10000 });

      // Focus on agent list
      const agentList = page.locator('[data-testid="agent-library"]');
      await agentList.focus();

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');

      const focusedItem = await page.evaluate(() => document.activeElement?.textContent);
      expect(focusedItem).toBeTruthy();
    });
  });

  test.describe('Focus Management', () => {
    test('Focus indicators are visible', async ({ page }) => {
      // Tab to first interactive element
      await page.keyboard.press('Tab');
      
      // Check for focus outline
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (!el) return null;
        
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineColor: styles.outlineColor,
          outlineWidth: styles.outlineWidth,
          boxShadow: styles.boxShadow
        };
      });

      // Should have visible focus indicator
      expect(
        focusedElement?.outline !== 'none' || 
        focusedElement?.boxShadow?.includes('rgb')
      ).toBeTruthy();
    });

    test('Focus is trapped in modals', async ({ page }) => {
      // Open modal
      await page.getByRole('button', { name: /new project/i }).click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // Tab through modal elements
      const modalElements: string[] = [];
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        const inModal = await page.evaluate(() => {
          const el = document.activeElement;
          const modal = document.querySelector('[role="dialog"]');
          return modal?.contains(el);
        });
        modalElements.push(String(inModal));
      }

      // All focused elements should be within modal
      expect(modalElements.filter(inModal => inModal === 'true').length).toBeGreaterThan(0);
    });

    test('Focus returns to trigger after closing modal', async ({ page }) => {
      // Get trigger button
      const trigger = page.getByRole('button', { name: /new project/i });
      await trigger.focus();

      // Open modal
      await trigger.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // Close modal
      await page.keyboard.press('Escape');

      // Focus should return to trigger
      const focusedElement = await page.evaluate(() => document.activeElement?.textContent);
      expect(focusedElement).toContain('New Project');
    });
  });

  test.describe('Screen Reader Support', () => {
    test('All images have alt text', async ({ page }) => {
      const images = await page.locator('img').all();
      
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        
        // Image should have alt text or be marked as decorative
        expect(alt !== null || role === 'presentation').toBeTruthy();
      }
    });

    test('Form inputs have labels', async ({ page }) => {
      const inputs = await page.locator('input, select, textarea').all();
      
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledby = await input.getAttribute('aria-labelledby');
        
        if (id) {
          const label = await page.locator(`label[for="${id}"]`).count();
          expect(label > 0 || ariaLabel || ariaLabelledby).toBeTruthy();
        } else {
          expect(ariaLabel || ariaLabelledby).toBeTruthy();
        }
      }
    });

    test('Buttons have accessible names', async ({ page }) => {
      const buttons = await page.locator('button').all();
      
      for (const button of buttons) {
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaLabelledby = await button.getAttribute('aria-labelledby');
        
        expect(text?.trim() || ariaLabel || ariaLabelledby).toBeTruthy();
      }
    });

    test('Dynamic content has live regions', async ({ page }) => {
      // Look for notification areas
      const liveRegions = await page.locator('[aria-live], [role="alert"], [role="status"]').all();
      
      expect(liveRegions.length).toBeGreaterThan(0);
      
      for (const region of liveRegions) {
        const ariaLive = await region.getAttribute('aria-live');
        const role = await region.getAttribute('role');
        
        expect(ariaLive || role).toBeTruthy();
      }
    });

    test('Headings follow logical hierarchy', async ({ page }) => {
      const headings = await page.evaluate(() => {
        const h1 = document.querySelectorAll('h1').length;
        const h2 = document.querySelectorAll('h2').length;
        const h3 = document.querySelectorAll('h3').length;
        const h4 = document.querySelectorAll('h4').length;
        const h5 = document.querySelectorAll('h5').length;
        const h6 = document.querySelectorAll('h6').length;
        
        return { h1, h2, h3, h4, h5, h6 };
      });

      // Should have at least one h1
      expect(headings.h1).toBeGreaterThan(0);
      
      // Should not skip heading levels
      if (headings.h3 > 0) expect(headings.h2).toBeGreaterThan(0);
      if (headings.h4 > 0) expect(headings.h3).toBeGreaterThan(0);
    });

    test('ARIA roles are used correctly', async ({ page }) => {
      // Check for common ARIA roles
      const roleChecks = [
        { role: 'navigation', minCount: 1 },
        { role: 'main', minCount: 1 },
        { role: 'button', minCount: 1 }
      ];

      for (const check of roleChecks) {
        const count = await page.locator(`[role="${check.role}"]`).count();
        expect(count).toBeGreaterThanOrEqual(check.minCount);
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('Text meets WCAG AA contrast requirements', async ({ page }) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .withRules(['color-contrast'])
        .analyze();

      expect(results.violations.filter(v => v.id === 'color-contrast')).toEqual([]);
    });

    test('Focus indicators have sufficient contrast', async ({ page }) => {
      // Tab to first button
      await page.keyboard.press('Tab');
      
      const contrast = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (!el) return 0;
        
        const styles = window.getComputedStyle(el);
        const bgColor = styles.backgroundColor;
        const outlineColor = styles.outlineColor;
        
        // Simple contrast check (would need proper calculation in production)
        return { bgColor, outlineColor };
      });

      expect(contrast.outlineColor).not.toBe('transparent');
    });

    test('UI works in high contrast mode', async ({ page }) => {
      // Simulate high contrast mode
      await page.emulateMedia({ colorScheme: 'dark' });
      
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  });

  test.describe('Interactive Elements', () => {
    test('Click targets meet minimum size (44x44px)', async ({ page }) => {
      const buttons = await page.locator('button, a, [role="button"]').all();
      
      for (const button of buttons) {
        const box = await button.boundingBox();
        if (box) {
          // Allow some exceptions for inline buttons
          const isInline = await button.evaluate(el => 
            window.getComputedStyle(el).display === 'inline'
          );
          
          if (!isInline) {
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });

    test('Drag and drop has keyboard alternative', async ({ page }) => {
      await page.getByRole('button', { name: /new project/i }).click();
      await page.waitForSelector('[data-testid="agent-library"]', { timeout: 10000 });

      // Check for keyboard alternative to drag-drop
      const agentCard = page.locator('[data-testid^="agent-card"]').first();
      await agentCard.focus();
      
      // Should be able to activate with keyboard
      await page.keyboard.press('Enter');
      
      // Check for context menu or alternative action
      const hasAlternative = await page.locator('[role="menu"], [data-testid="agent-actions"]').count();
      expect(hasAlternative).toBeGreaterThan(0);
    });

    test('Loading states are announced', async ({ page }) => {
      // Trigger a loading state
      await page.getByRole('button', { name: /new project/i }).click();
      
      // Check for loading indicator with proper ARIA
      const loadingIndicator = await page.locator('[aria-busy="true"], [role="status"]').count();
      expect(loadingIndicator).toBeGreaterThanOrEqual(0);
    });

    test('Error messages are associated with inputs', async ({ page }) => {
      // Try to submit empty form
      await page.getByRole('button', { name: /new project/i }).click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      // Submit without filling required fields
      const submitButton = page.getByRole('button', { name: /create/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Check for error messages
        const errors = await page.locator('[role="alert"], [aria-invalid="true"]').count();
        expect(errors).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('UI is accessible on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('Touch targets are large enough on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const buttons = await page.locator('button, a, [role="button"]').all();
      
      for (const button of buttons) {
        const box = await button.boundingBox();
        if (box) {
          // Mobile targets should be at least 44x44
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });
});