1. admin dashboard -> Billing tab -> Generate Invoice: client dropdown list has no clients to select from.

2. admin dashboard -> Billing tab -> Actions -> Send (email): Error: Invalid request. Provide: type (access_code/welcome/custom) with required fields
   Billing.jsx:193 POST http://localhost:3002/api/email/platform/test 400 (Bad Request)
   dispatchXhrRequest @ axios.js?v=c971edd9:1696
   xhr @ axios.js?v=c971edd9:1573
   dispatchRequest @ axios.js?v=c971edd9:2107
   Promise.then
   \_request @ axios.js?v=c971edd9:2310
   request @ axios.js?v=c971edd9:2219
   httpMethod @ axios.js?v=c971edd9:2356
   wrap @ axios.js?v=c971edd9:8
   sendInvoiceEmail @ Billing.jsx:193
   onClick @ Billing.jsx:479
   callCallback2 @ chunk-YZVM2MHU.js?v=c971edd9:3674
   invokeGuardedCallbackDev @ chunk-YZVM2MHU.js?v=c971edd9:3699
   invokeGuardedCallback @ chunk-YZVM2MHU.js?v=c971edd9:3733
   invokeGuardedCallbackAndCatchFirstError @ chunk-YZVM2MHU.js?v=c971edd9:3736
   executeDispatch @ chunk-YZVM2MHU.js?v=c971edd9:7014
   processDispatchQueueItemsInOrder @ chunk-YZVM2MHU.js?v=c971edd9:7034
   processDispatchQueue @ chunk-YZVM2MHU.js?v=c971edd9:7043
   dispatchEventsForPlugins @ chunk-YZVM2MHU.js?v=c971edd9:7051
   (anonymous) @ chunk-YZVM2MHU.js?v=c971edd9:7174
   batchedUpdates$1 @ chunk-YZVM2MHU.js?v=c971edd9:18913
   batchedUpdates @ chunk-YZVM2MHU.js?v=c971edd9:3579
   dispatchEventForPluginEventSystem @ chunk-YZVM2MHU.js?v=c971edd9:7173
   dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ chunk-YZVM2MHU.js?v=c971edd9:5478
   dispatchEvent @ chunk-YZVM2MHU.js?v=c971edd9:5472
   dispatchDiscreteEvent @ chunk-YZVM2MHU.js?v=c971edd9:5449Understand this error
   billing:1 Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received

I also dont think this is the correct endpoint for sending invoices: http://localhost:3002/api/email/platform/test

3. customer dashboard -> Usage tab: need to add costs and time filters. also the useage trends don't seem to work correctly (there is no data) and the dates at the bottom seem to bleed out of the frame. There is also an error:
   installHook.js:1 Warning: Each child in a list should have a unique "key" prop.

Check the render method of `Usage`. See https://reactjs.org/link/warning-keys for more information.
at tr
at Usage (http://localhost:3003/src/pages/Usage.jsx:23:50)
at RenderedRoute (http://localhost:3003/node_modules/.vite/deps/react-router-dom.js?v=bf8720d9:4108:5)
at Routes (http://localhost:3003/node_modules/.vite/deps/react-router-dom.js?v=bf8720d9:4578:5)
at main
at div
at div
at Layout (http://localhost:3003/src/components/layout/Layout.jsx:22:34)
at ProtectedRoute (http://localhost:3003/src/App.jsx:28:27)
at RenderedRoute (http://localhost:3003/node_modules/.vite/deps/react-router-dom.js?v=bf8720d9:4108:5)
at Routes (http://localhost:3003/node_modules/.vite/deps/react-router-dom.js?v=bf8720d9:4578:5)
at App
at LanguageProvider (http://localhost:3003/src/context/LanguageContext.jsx:23:36)
at AuthProvider (http://localhost:3003/src/context/AuthContext.jsx:21:32)
at Router (http://localhost:3003/node_modules/.vite/deps/react-router-dom.js?v=bf8720d9:4521:15)
at BrowserRouter (http://localhost:3003/node_modules/.vite/deps/react-router-dom.js?v=bf8720d9:5267:5)
