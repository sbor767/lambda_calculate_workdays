//AWS SDK уже встроен, его не нужно загружать отдeльно
import "aws-sdk"; // только подключить
//Все что вам нужно, лучше подключать здесь
//Это пример с API Gateway.
//Если проще, то это обычный http запрос
const handler = async (event, context) => {
  //В event нам приходит вся инфа о запросе
  //В context нам приходит текущий контекст aws lambda функции:
  // почему была запущена, кем и прочая вспомогательная инфа
  console.log("testing cloud watch");
  // ^ Таким образом мы можем писать в Cloud Watch кастомные сообщения
  return {
    //Таким образом мы отвечаем на http запрос, думаю ниже все понятно
    statusCode: 200,
    body: "Hello world",
    headers: {},
  };
};

export { handler };
