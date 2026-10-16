'use client';

import { useState } from 'react';

import { HeaderShell, LanguageSwitcher, MenuIcon, MobileNav, XIcon } from './navigation';

/**
 * The shell around every page.
 *
 * A Client Component because it owns one piece of state — whether the mobile
 * menu is open. Everything it renders is server-rendered markup passed down as
 * `children`, so the client bundle contains only this component and the
 * navigation it uses.
 */
export function ShellChrome({ locale, dict, children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <HeaderShell locale={locale} dict={dict}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          className="btn btn-secondary btn-sm"
        >
          {menuOpen ? (
            <XIcon className="h-4 w-4" />
          ) : (
            <MenuIcon className="h-4 w-4" />
          )}
          <span className="sr-only sm:not-sr-only">
            {menuOpen ? dict.nav.closeMenu : dict.nav.openMenu}
          </span>
        </button>
      </HeaderShell>

      <div id="mobile-navigation">
        <MobileNav
          locale={locale}
          dict={dict}
          open={menuOpen}
          onNavigate={() => setMenuOpen(false)}
        />
      </div>

      {/*
        A compact emergency strip, small screens only.

        The full notice already sits above the navigation; this repeats just the
        action line so it stays with a reader who has scrolled a long way down.
        Deliberately not shown on large screens, where it would be a second
        identical warning directly under the first.
      */}
      <div className="border-b border-danger-200 bg-danger-100 px-4 py-2 sm:hidden">
        <p className="text-center text-xs font-semibold text-danger-800">
          {dict.emergency.action}
        </p>
      </div>

      {children}
    </>
  );
}