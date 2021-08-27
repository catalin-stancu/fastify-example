// // TODO: unit test for S.removeRequired()
// const test = S.object()
//   .required(['a'])
//   .prop('a', S.object()
//     .required(['b'])
//     .prop('b', S.object()
//       .required(['c'])
//       .prop('c', S.object()
//         .required(['d'])
//         .prop('d', S.string())
//         .anyOf([
//           S.object().required(['e']).prop('e', S.string()),
//           S.object().required(['f']).prop('f', S.object()
//             .required(['g'])
//             .prop('g', S.string())
//             .allOf([
//               S.object().required(['h']).prop('h', S.string()),
//               S.object().required(['i']).prop('i', S.object()
//                 .required(['j'])
//                 .prop('j', S.string())
//                 .oneOf([
//                   S.object().required(['k']).prop('k', S.string()),
//                   S.object().required(['l']).prop('l', S.object()),
//                 ])
//               ),
//             ]),
//           )
//         ]))));

// console.log('\n\n\n\nFinal', JSON.stringify(S.removeRequired(test).valueOf(), null, 2));

// // TODO: unit test for S.mergeSchemasList()
// const s1 = S.object().prop('a', S.string().required());
// const s2 = S.object().prop('b', S.string().required());
// const s3 = S.object().prop('c', S.string().required());

// console.log('\n\nResult: ', S.mergeSchemasList([s1, s2, s3], '#tarzan').valueOf());