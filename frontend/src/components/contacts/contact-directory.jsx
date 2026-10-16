'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

import { CATEGORY_KEYS, ContactList } from '@/components/contacts/contact-list';

/**
 * Client-side filtering over the contacts directory.
 *
 * The full list is fetched once on the server and filtered in the browser. That
 * is a deliberate trade for this dataset — tens of entries, not thousands —
 * and it buys two things that matter more than the saved round trip: filtering
 * is instant on a slow connection, and a resident who types a search term does
 * not have their keystrokes sent to a server that logs them.
 */
export function ContactDirectory({ contacts, dict, locale }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [emergencyOnly, setEmergencyOnly] = useState(false);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return (contacts ?? []).filter((contact) => {
      if (category && contact.category !== category) return false;
      if (emergencyOnly && !contact.isEmergency) return false;

      if (!needle) return true;

      // Matches the name, the description and the category, because someone
      // looking for "clinic" should not have to know which category it sits in.
      return [contact.name, contact.description, contact.category, contact.coverageArea]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [contacts, search, category, emergencyOnly]);

  const hasFilters = Boolean(search || category || emergencyOnly);

  return (
    <div className="space-y-6">
      <div className="card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label htmlFor="contact-search" className="field-label">
              {dict.contacts.searchLabel}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden="true"
              />
              <input
                id="contact-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={dict.contacts.searchPlaceholder}
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact-category" className="field-label">
              {dict.common.search}
            </label>
            <select
              id="contact-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="select"
            >
              <option value="">{dict.staff.filterAll}</option>
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {dict.contacts[`category${toPascalCase(key)}`] ?? key}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={emergencyOnly}
            onChange={(event) => setEmergencyOnly(event.target.checked)}
            className="h-5 w-5 rounded border-border-strong text-brand-700 focus:ring-brand-500"
          />
          <span className="text-sm font-medium text-ink">{dict.contacts.emergencyOnlyLabel}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Announced politely so a screen-reader user learns that filtering
            changed the list without being interrupted mid-sentence. */}
        <p className="text-sm text-ink-muted" aria-live="polite">
          {filtered.length === 1
            ? dict.contacts.resultsCountOne
            : dict.contacts.resultsCount.replace('{count}', String(filtered.length))}
        </p>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategory('');
              setEmergencyOnly(false);
            }}
            className="btn btn-ghost btn-sm"
          >
            <X className="h-3.5 w-3.5" />
            {dict.common.retry}
          </button>
        )}
      </div>

      <ContactList
        contacts={filtered}
        dict={dict}
        locale={locale}
        emptyTitle={dict.contacts.emptyTitle}
        emptyBody={dict.contacts.emptyBody}
      />
    </div>
  );
}

function toPascalCase(value) {
  return String(value)
    .toLowerCase()
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}