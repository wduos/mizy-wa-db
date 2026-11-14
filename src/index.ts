/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/stores') {
			const { results } = await env.DB.prepare('SELECT * FROM stores').all();
			return Response.json(results);
		}

		if (url.pathname === '/flyers') {
			if (request.method === 'GET') {
				const { results } = await env.DB.prepare('SELECT * FROM flyers').all();
				return Response.json(results);
			}

			if (request.method === 'POST') {
				try {
					const body = (await request.json()) as { store_id: number; base_64: string; caption: string; mime_type: string };

					if (!body.store_id || !body.base_64 || !body.caption || !body.mime_type) {
						return Response.json({ error: 'Missing required fields: store_id, base_64, caption, mime_type' }, { status: 400 });
					}

					const info = await env.DB.prepare('INSERT INTO flyers (store_id, base_64, caption, mime_type) VALUES (?, ?, ?, ?)')
						.bind(body.store_id, body.base_64, body.caption, body.mime_type)
						.run();

					return Response.json({ success: true, info }, { status: 201 });
				} catch (err) {
					return Response.json({ success: false, error: 'Invalid JSON body or database error:' + err }, { status: 400 });
				}
			}

			if (request.method === 'DELETE') {
				const id = url.searchParams.get('id');

				if (!id) {
					return Response.json({ error: 'Missing required query parameter: id' }, { status: 400 });
				}

				try {
					const info = await env.DB.prepare('DELETE FROM flyers WHERE id = ?').bind(id).run();

					if (info.meta && info.meta.changes === 0) {
						return Response.json({ success: false, error: 'Flyer not found' }, { status: 500 });
					}

					return Response.json({ success: true, info }, { status: 200 });
				} catch (err) {
					return Response.json({ success: false, error: 'Database error:' + err }, { status: 500 });
				}
			}

			return new Response('Method not allowed', { status: 405 });
		}

		return new Response('API is running.', { status: 200 });
	},
} satisfies ExportedHandler<Env>;
