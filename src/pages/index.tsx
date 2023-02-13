import Head from 'next/head'
import Image from 'next/image'
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'
import { useSubscribe } from '@/hooks';

const inter = Inter({ subsets: ['latin'] });

const r = {
  query: {
    sql: "SELECT 1;"
  }
}
export default function Home() {
  const { data } = useSubscribe(r);

  console.log(data);

  return (
    <>
      <Head>
        <title>Create Materialize App</title>
        <meta name="description" content="Generated by create materialize app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <div className={styles.description}>
          <div>
            <a
              href="https://materialize.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/materialize-logo.svg"
                alt="Materialize Logo"
                className={styles.vercelLogo}
                width={200}
                height={60}
                priority
              />
            </a>
          </div>
        </div>

        <div className={`${styles.center} flex-col`}>
          <h1 className={`${inter.className} font-semibold text-transparent bg-clip-text text-5xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500`}>Boilerplate for Apps</h1>
        </div>

        <div className={styles.grid}>
        </div>
      </main>
    </>
  )
}
