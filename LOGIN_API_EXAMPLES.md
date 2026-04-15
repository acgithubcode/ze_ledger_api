# Login API Examples

## Register

POST `http://localhost:5000/api/v1/auth/register`

```json
{
  "name": "Aman",
  "email": "aman@example.com",
  "password": "Admin@123"
}
```

## Login

POST `http://localhost:5000/api/v1/auth/login`

```json
{
  "email": "aman@example.com",
  "password": "Admin@123"
}
```

## Guest Login

POST `http://localhost:5000/api/v1/auth/guest`

```json
{
  "name": "Demo User"
}
```
