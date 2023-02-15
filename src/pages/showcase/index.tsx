import React from "react";
import Chart from "../chart";
import Notifications from "../notification";
import Table from "../table";
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'

const inter = Inter({ subsets: ['latin'] });

export default function Showcase() {
    return (
        <div className="flex flex-col overflow-hidden max-h-screen">
            <div className={`${styles.center} flex-col flex-initial`}>
                <h1 className={`${inter.className} font-semibold text-transparent bg-clip-text text-5xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500`}>Showcase</h1>
            </div>
            <div className="flex-1 grid grid-cols-3 divide-x-2 divide-gray-300 mb-10">
                <div className="text-center">
                    <h2 className={`${inter.className} font-semibold text-3xl`}>Chart</h2>
                    <h4 className={`${inter.className} font-light text-xl text-gray-600`}>Key undefined</h4>
                    <Chart />
                </div>
                <div className="text-center overflow-hidden">
                    <h2 className={`${inter.className} font-semibold text-3xl`}>Table</h2>
                    <h4 className={`${inter.className} font-light text-xl text-gray-600`}>Key =  Replica ID</h4>
                    <Table />
                </div>
                <div className="text-center">
                    <h2 className={`${inter.className} font-semibold text-3xl`}>Notification</h2>
                    <h4 className={`${inter.className} font-light text-xl text-gray-600`}>Key undefined</h4>
                    <Notifications />
                </div>
            </div>
        </div>
    )
}