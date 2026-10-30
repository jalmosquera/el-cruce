function approvedOrigin(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }

  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/'
      && !url.search && !url.hash ? url.origin : ''
  } catch {
    return ''
  }
}

export function publicQrPath(identifier) {
  return `/q/${encodeURIComponent(identifier)}/`
}

export function publicQrUrl(
  identifier,
  configuredUrl = import.meta.env.VITE_PUBLIC_SITE_URL ?? import.meta.env.PUBLIC_SITE_URL,
) {
  const path = publicQrPath(identifier)
  const origin = approvedOrigin(configuredUrl)
  return origin ? `${origin}${path}` : path
}
