import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/admin/',
          '/api/',
          '/login',
          '/signup',
          '/reset-password',
          '/update-password',
          '/verify',
        ],
      },
    ],
    sitemap: 'https://klipflowai.com/sitemap.xml',
    host: 'https://klipflowai.com',
  }
}