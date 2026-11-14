export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/stores') {
			const { results } = await env.DB.prepare('SELECT * FROM stores').all();
			return Response.json(results);
		}

		if (url.pathname === '/flyers') {
			if (request.method === 'GET') {
				const statusParam = url.searchParams.get('status');

				let query = 'SELECT * FROM flyers';
				const bindings: string[] = [];

				if (statusParam) {
					const allowedStatuses = ['RECEIVED', 'PROCESSED', 'DELETED'];

					if (!allowedStatuses.includes(statusParam)) {
						return Response.json(
							{
								error: `Invalid status filter. Must be one of: ${allowedStatuses.join(', ')}`,
							},
							{ status: 400 },
						);
					}

					query += ' WHERE status = ?';
					bindings.push(statusParam);
				}

				const { results } = await env.DB.prepare(query)
					.bind(...bindings)
					.all();
				return Response.json(results);
			}

			if (request.method === 'POST') {
				try {
					const body = (await request.json()) as {
						store_id: number;
						base_64: string;
						caption: string;
						mime_type: string;
						status?: 'RECEIVED' | 'PROCESSED' | 'DELETED';
					};

					if (!body.store_id || !body.base_64 || !body.caption || !body.mime_type) {
						return Response.json({ error: 'Missing required fields: store_id, base_64, caption, mime_type' }, { status: 400 });
					}

					const allowedStatuses = ['RECEIVED', 'PROCESSED', 'DELETED'];
					const status = body.status || 'RECEIVED';

					if (!allowedStatuses.includes(status)) {
						return Response.json(
							{
								error: `Invalid status value. Must be one of: ${allowedStatuses.join(', ')}`,
							},
							{ status: 400 },
						);
					}

					const info = await env.DB.prepare('INSERT INTO flyers (store_id, base_64, caption, mime_type, status) VALUES (?, ?, ?, ?, ?)')
						.bind(body.store_id, body.base_64, body.caption, body.mime_type, status)
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
						return Response.json({ success: false, error: 'Flyer not found' }, { status: 404 });
					}

					return Response.json({ success: true, info }, { status: 200 });
				} catch (err) {
					return Response.json({ success: false, error: 'Database error:' + err }, { status: 500 });
				}
			}

			if (request.method === 'PATCH') {
				const id = url.searchParams.get('id');

				if (!id) {
					return Response.json({ error: 'Missing required query parameter: id' }, { status: 400 });
				}

				try {
					const body = (await request.json()) as {
						store_id?: number;
						base_64?: string;
						caption?: string;
						mime_type?: string;
						status?: 'RECEIVED' | 'PROCESSED' | 'DELETED';
					};

					const fields: string[] = [];
					const values: any[] = [];

					if (body.store_id !== undefined) {
						fields.push('store_id = ?');
						values.push(body.store_id);
					}
					if (body.base_64 !== undefined) {
						fields.push('base_64 = ?');
						values.push(body.base_64);
					}
					if (body.caption !== undefined) {
						fields.push('caption = ?');
						values.push(body.caption);
					}
					if (body.mime_type !== undefined) {
						fields.push('mime_type = ?');
						values.push(body.mime_type);
					}
					if (body.status !== undefined) {
						const allowedStatuses = ['RECEIVED', 'PROCESSED', 'DELETED'];
						const status = body.status || 'RECEIVED';

						if (!allowedStatuses.includes(status)) {
							return Response.json(
								{
									error: `Invalid status value. Must be one of: ${allowedStatuses.join(', ')}`,
								},
								{ status: 400 },
							);
						}
						fields.push('status = ?');
						values.push(status);
					}

					if (fields.length === 0) {
						return Response.json({ error: 'No fields provided to update' }, { status: 400 });
					}

					values.push(id);

					const query = `UPDATE flyers SET ${fields.join(', ')} WHERE id = ?`;
					const info = await env.DB.prepare(query)
						.bind(...values)
						.run();

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
