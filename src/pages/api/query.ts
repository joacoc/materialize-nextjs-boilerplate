// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { Params } from '@/hooks';
import type { NextApiRequest, NextApiResponse } from 'next'
import { Client } from "pg";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { body } = req;
    const { params }: { params: Params} = body;
    const { query, config } = params;
    const { sql, cluster } = query;

    if (!query || !config) {
        res.status(400).json("Missing query");
        return;
    }

    const { host, auth } = config;

    if (!host || !auth || !auth.user || !auth.password) {
        res.status(400).json("Missing config fields.");
        return;
    }

    const { user, password } = auth;
    const client = new Client({
        host,
        port: 6875,
        user,
        password,
        database: "materialize",
        ssl: true
    });

    try {
        await client.connect();

        try {
          const results = cluster ? await client.query(`SET CLUSTER = ${cluster}; ${query};`, []) : await client.query(sql, []);
          res.status(200).json(results);
        } catch (err) {
          console.error(err);
          res.status(500).json("Error running query");
        }
    } catch (err) {
        console.error(err);
        res.status(500).json("Error connecting");
    }
}
}