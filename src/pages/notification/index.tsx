import { Fragment, useEffect, useMemo, useState } from 'react'
import { Transition } from '@headlessui/react'
import { CheckCircleIcon, ExclamationTriangleIcon, FireIcon } from '@heroicons/react/24/outline'
import { XMarkIcon } from '@heroicons/react/20/solid'
import { useSubscribe } from '@/hooks';
import { Inter } from '@next/font/google';
import History from "@/components/history";
import styles from '@/styles/Home.module.css';

const inter = Inter({ subsets: ['latin'] });

export default function Notifications() {
    const { data, history } = useSubscribe({
        query: {
            sql: `
                SELECT
                CASE
                    WHEN EXTRACT(SECOND FROM last_timestamp) % 60 < 20 THEN 'Low'
                    WHEN EXTRACT(SECOND FROM last_timestamp) % 60 < 40 THEN 'Medium'
                    WHEN EXTRACT(SECOND FROM last_timestamp) % 60 < 60 THEN 'Large'
                END level
                FROM (
                    SELECT max(to_timestamp((time::text::numeric / 1000) + 10000)) as last_timestamp
                    FROM mz_internal.mz_compute_frontiers WHERE time > 0
                )
                WHERE mz_now() < last_timestamp
            `,
            collectHistory: true
        }
    });
    const [show, setShow] = useState(false);
    const [level, setLevel] = useState<String | undefined>();
    const {
        message,
        icon,
    } = useMemo(() => {
        switch (level) {
            case "Medium":
                return {
                    message: "Systems look.. quite strange!",
                    icon: <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" aria-hidden="true" />
                };
            case "Large":
                return {
                    message: "Systems are on fire!",
                    icon: <FireIcon className="h-6 w-6 text-red-400" aria-hidden="true" />
                };
            default:
                return {
                    message: "Systems are operational!",
                    icon: <CheckCircleIcon className="h-6 w-6 text-green-400" aria-hidden="true" />
                };
        }
    }, [level]);

    useEffect(() => {
        if (data && data.rows && data.rows.length > 0) {
            console.log(data.rows);
            const [{ level }] = data.rows;
            setLevel(level);
            setShow(true);
        }
    }, [data]);


    return (
        <>

        <main className={styles.main}>
        <div
            aria-live="assertive"
            className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6"
        >
            <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
            <Transition
                show={show}
                as={Fragment}
                enter="transform ease-out duration-300 transition"
                enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
                enterTo="translate-y-0 opacity-100 sm:translate-x-0"
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
            >
                <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                <div className="p-4">
                    <div className="flex items-start">
                    <div className="flex-shrink-0">
                        {icon}
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className="text-sm font-medium text-gray-900">{message}</p>
                    </div>
                    <div className="ml-4 flex flex-shrink-0">
                        <button
                        type="button"
                        className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        onClick={() => {
                            setShow(false)
                        }}
                        >
                        <span className="sr-only">Close</span>
                        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                    </div>
                </div>
                </div>
            </Transition>
            </div>
        </div>
        {history && (
                <div className="mt-10 text-gray-500 bg-white rounded-md">
                    <h1 className={inter.className}>History</h1>
                    <History history={history} className={"max-h-80 overflow-scroll"} />
                </div>
        )}
        </main>
        </>
    );
}
