import { Update } from "@/hooks/utils/state";
import React from "react";

interface Props<T> {
    history?: Readonly<Array<Update<T>>>;
    className?: string;
}

const History = function<T>(props: Props<T>): JSX.Element {
    const { history, className, } = props;

    return (
        <div className={className}>
            <ul role="list" className="divide-y divide-gray-200 overflow-hidden">
                {/* Reverse map */}
                {history && history.map((_, i) => {
                    const { value, diff } = history[history.length - i - 1];

                    return (
                        <li key={String(i)} className="flex py-4">
                            <div className="flex flex-row">
                                <div className="text-sm font-medium max-w-xs">
                                    <div className="flex flex-row">
                                        <p className="text-gray-900 mr-2">{"Value: "}</p>
                                        <p className="text-ellipsis whitespace-nowrap overflow-clip">{JSON.stringify(value)}</p>
                                    </div>
                                </div>
                                <div className="ml-2 flex flex-shrink-0 float-right h-fit">
                                    <p className={`inline-flex rounded-full ${diff > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800" } px-2 text-xs font-semibold leading-5`}>
                                        {diff}
                                    </p>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default History;