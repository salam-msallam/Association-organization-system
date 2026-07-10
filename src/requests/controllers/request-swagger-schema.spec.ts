import { requestBodySchema } from './request-swagger-schema';

describe('requestBodySchema', () => {
  it('documents bilingual fields as JSON strings for multipart/form-data compatibility', () => {
    const schema = requestBodySchema({}, []);

    expect(schema.properties.address).toMatchObject({
      type: 'string',
      format: 'json',
    });
    expect(schema.properties.details).toMatchObject({
      type: 'string',
      format: 'json',
    });
  });
});
