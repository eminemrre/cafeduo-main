/** How café owners reach CafeDuo: the pilot's WhatsApp line and the e-mail address. */
const WHATSAPP_NUMBER = '905538542535';

export const DEFAULT_PILOT_MESSAGE =
  'Selam, cafeduotr.com pilot programı için yazıyorum. Kafem hakkında konuşabilir miyiz?';

export const CONTACT_EMAIL = 'info@cafeduotr.com';

export const whatsappLink = (message: string = DEFAULT_PILOT_MESSAGE) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export const pilotMailto = `mailto:${CONTACT_EMAIL}?subject=Pilot%20Ba%C5%9Fvuru&body=Kafemin%20ad%C4%B1%3A%20%0AKonum%3A%20%0AInstagram%3A%20%0A`;
