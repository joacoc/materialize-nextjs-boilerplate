import { useSubscribe } from "@/hooks";
import styles from '@/styles/Home.module.css'
import React, { useEffect, useMemo, useState } from "react";
import { Inter } from '@next/font/google'

/**
 * Chart Configuration
 */
import { Chart as ChartJS, registerables, Colors, ChartData } from 'chart.js';
import { Bar } from "react-chartjs-2";
import History from "@/components/history";
ChartJS.register(...registerables, Colors);

const inter = Inter({ subsets: ['latin'] });

const Chart = (): JSX.Element => {
    const { data, history } = useSubscribe({
        query: {
            sql: "SELECT replica_id, cpu_percent FROM mz_internal.mz_cluster_replica_utilization",
            collectHistory: true
        }
    });
    const label = useMemo(() => "CPU Percent", []);
    const [state, setState] = useState<ChartData<"bar">>({
        datasets: [{
            label,
            data: []
        }],
    })

    useEffect(() => {
        const sortedData = (data && data.rows && data.rows.sort((a, b) => a.replica_id - b.replica_id) || []).sort();
        const barData = sortedData.map(row => row.cpu_percent);
        const labels = sortedData.map(row => row.replica_id);

        setState({
            datasets: [{
                label,
                data: barData
            }],
            labels
        });
    }, [data]);

    return (
        <main className={styles.main}>
            <div className="bg-white rounded-md w-96 h-fit p-3 shadow-md ring-black border-1">
                <Bar
                    data={state}
                    options={{ scales: { y: { max: 100, min: 0, grid: { display: false, } } }}}
                />

                {history && <div className="mt-10 text-gray-500">
                    <h1 className={inter.className}>History</h1>
                    <History history={history} className={"max-h-80 overflow-scroll"} />
                </div>}
            </div>
        </main>
    );
};

export default Chart;