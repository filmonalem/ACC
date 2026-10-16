import {
  FileTextIcon,
  HeartHandshakeIcon,
  HomeIcon,
  InfoIcon,
  MegaphoneIcon,
  PhoneIcon,
} from './icons';

/**
 * The site's navigation, as data.
 *
 * Kept out of the Client Component so the Server Component footer can render the
 * same list without importing the client boundary. One definition means the
 * header and the footer cannot drift apart — which is the failure where a
 * reader finds a page in the footer that is missing from the navigation.
 *
 * `key` is a dictionary path, not a literal: the label is looked up so a new
 * language is a new dictionary entry rather than an edit in every component.
 */
export const NAV_ITEMS = [
  { href: '', key: 'home', icon: HomeIcon },
  { href: '/report', key: 'report', icon: FileTextIcon },
  { href: '/contacts', key: 'contacts', icon: PhoneIcon },
  { href: '/updates', key: 'updates', icon: MegaphoneIcon },
  { href: '/support', key: 'support', icon: HeartHandshakeIcon },
  { href: '/about', key: 'about', icon: InfoIcon },
];

/** Links shown in the footer but not in the primary navigation. */
export const SECONDARY_NAV = [
  { href: '/status', key: 'status' },
  { href: '/privacy', key: 'privacy' },
];