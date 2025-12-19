# Admin Dashboard

A modern admin dashboard built with Next.js, shadcn/ui, and Supabase.

## Features

- Next.js 15 with App Router
- TypeScript for type safety
- shadcn/ui components with Tailwind CSS
- Supabase authentication and database
- Responsive sidebar navigation
- Dashboard with metrics cards
- Login/signup authentication flow

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project

### Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

3. Add your Supabase credentials to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

You can find these values in your Supabase project settings under API.

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
admin-dashboard/
├── app/                      # Next.js app directory
│   ├── dashboard/           # Dashboard pages
│   ├── login/              # Authentication page
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page (redirects)
├── components/             # React components
│   ├── ui/                # shadcn/ui components
│   ├── header.tsx         # Dashboard header
│   └── sidebar.tsx        # Dashboard sidebar
├── lib/                   # Utility functions
│   ├── supabase/         # Supabase client utilities
│   └── utils.ts          # Helper functions
└── middleware.ts         # Next.js middleware for auth

```

## Authentication Setup

To enable authentication in your Supabase project:

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Settings
3. Configure your site URL and redirect URLs
4. Enable Email provider in Authentication > Providers

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Supabase](https://supabase.com/) - Backend and authentication
- [Lucide React](https://lucide.dev/) - Icons

## License

ISC
