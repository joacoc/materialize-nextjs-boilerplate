import { useSubscribe } from "@/hooks";
import styles from '@/styles/Home.module.css';
import React from "react";
import { Inter } from '@next/font/google';

const inter = Inter({ subsets: ['latin'] });

import History from "@/components/history";

const Table = (): JSX.Element => {
    const { data, history } = useSubscribe({
        query: {
            key: "replica_id",
            sql: "SELECT replica_id, cpu_percent FROM mz_internal.mz_cluster_replica_utilization LIMIT 5",
            collectHistory: true
        }
    });
    const sortedData = (data && data.rows && data.rows.sort((a, b) => a.replica_id - b.replica_id) || []).sort();
    const background = (percent: Number) => {
        if (percent < 25) {
            return "green"
        } else if (percent < 75) {
            return "yellow"
        } else {
            return "red"
        }
    }
    return (
        <main className={styles.main}>
            <div className="flex flex-row">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col">
                        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                                    Replica ID
                                    </th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                    CPU Percent
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="max-h-52 divide-y divide-gray-200 bg-white">
                                {sortedData.map(({ replica_id, cpu_percent }) => (
                                    <tr key={replica_id}>
                                        <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                            {replica_id}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                                            <span className={`inline-flex rounded-full bg-${background(cpu_percent)}-200 px-2 text-xs font-semibold leading-5 text-${background(cpu_percent)}-800`}>
                                                {cpu_percent}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                            {history && (
                                <div className="bg-white rounded-md w-96 h-fit p-2 shadow-md border-gray-100 border-1 border-t-0">
                                    <div className="text-gray-500">
                                        <h1 className={inter.className}>History</h1>
                                        <History history={history} className={"max-h-80 max-w-96 overflow-scroll"} />
                                    </div>
                                </div>
                            )}
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Table;