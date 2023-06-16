## 1. Install open-next(0.9.3)

```
npm install -g open-next@0.9.3
```

## 2. Build Object

```
npx open-next build
```

## 3. Upload static resources

```
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} aws s3 \
cp ./.open-next/assets/ s3://${S3_BUCKET_NAME}/ \
--acl bucket-owner-full-control \
--recursive \
--cache-control 'public,max-age=600,s-maxage=3600' \
--exclude '.git/*' \
--region ${AWS_REGOIN}
```

## 4. Zip lambda functions

```
cd .open-next
cd server-function && zip -r ../server-function.zip . && cd ..
cd image-optimization-function && zip -r ../image-optimization-function.zip . && cd ..
```

## 5. Deploy lambda function: Server Function
```
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} aws lambda update-function-code --function-name ${LAMBDA_FUNCTION_NAME} --zip-file fileb://server-function.zip --region ap-east-1
```


## 6. Deploy Lambda function: Image Optimization Function
```
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} aws lambda update-function-code --function-name ${LAMBDA_FUNCTION_NAME} --zip-file fileb://image-optimization-function.zip --region ap-east-1
```

## 7. Refresh DNS
```
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} aws cloudfront create-invalidation --distribution-id ${DISTRIBUTION_ID} --paths "/*"
```