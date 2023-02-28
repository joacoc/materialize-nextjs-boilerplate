This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Steps

1. Clone the repository and set the `taxis` branch
2. Install dependencies
  ```bash
  yarn install
  ```
3. Fill the [Mapbox token](https://github.com/joacoc/materialize-nextjs-boilerplate/blob/9f13447094c9f8af382a055ca2ff97c33bc5b2e9/src/pages/index.tsx#L8) and [Materialize config](https://github.com/joacoc/materialize-nextjs-boilerplate/blob/9f13447094c9f8af382a055ca2ff97c33bc5b2e9/src/pages/index.tsx#L27)
4. Select the table/materialized view you want to consume [the taxis positions](https://github.com/joacoc/materialize-nextjs-boilerplate/blob/f77bba5f960de53625c0c1661efa904c9fa4ac98/src/pages/index.tsx#L28)
5. Run `yarn dev` and watch the taxis moving in real-time!


### Extra - Getting Started


Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
