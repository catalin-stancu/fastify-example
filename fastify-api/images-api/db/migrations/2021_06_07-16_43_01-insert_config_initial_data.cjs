module.exports = {
  up: (queryInterface, DataTypes) => queryInterface.sequelize.transaction(async t => {
    const pimVariantResolutions = {
      desktop: {
        v1: {
          width: 1024,
          height: 768
        },
        v2: {
          width: 1920,
          height: 1080
        }
      },
      tablet: {
        v1: {
          width: 601,
          height: 962
        },
        v2: {
          width: 640,
          height: 980
        }
      },
      mobile: {
        v1: {
          width: 360,
          height: 640
        },
        v2: {
          width: 390,
          height: 680
        }
      },
      cart: {
        v1: {
          width: 330,
          height: 600
        },
        v2: {
          width: 360,
          height: 640
        }
      },
      minicart: {
        v1: {
          width: 200,
          height: 400
        },
        v2: {
          width: 240,
          height: 440
        }
      },
      checkout: {
        v1: {
          width: 125,
          height: 340
        },
        v2: {
          width: 145,
          height: 360
        }
      }
    };

    const cmsVariantResolutions = {
      desktop: {
        v1: {
          width: 1024,
          height: 768
        },
        v2: {
          width: 1920,
          height: 1080
        }
      },
      tablet: {
        v1: {
          width: 601,
          height: 962
        },
        v2: {
          width: 640,
          height: 980
        }
      },
      mobile: {
        v1: {
          width: 360,
          height: 640
        },
        v2: {
          width: 390,
          height: 680
        }
      },
      cart: {
        v1: {
          width: 330,
          height: 600
        },
        v2: {
          width: 360,
          height: 640
        }
      },
      minicart: {
        v1: {
          width: 200,
          height: 400
        },
        v2: {
          width: 240,
          height: 440
        }
      },
      checkout: {
        v1: {
          width: 125,
          height: 340
        },
        v2: {
          width: 145,
          height: 360
        }
      }
    };

    const whatToInsert = [
      {
        id: 'dam',
        min_rez_vertical: 768,
        min_rez_horizontal: 1024,
        max_rez_vertical: 4000,
        max_rez_horizontal: 4000,
        created_by: 'a6516da4-b7ba-4b74-a953-0308d3c8f90d',
        modified_by: 'a6516da4-b7ba-4b74-a953-0308d3c8f90d'
      },
      {
        id: 'pim',
        min_rez_vertical: 768,
        min_rez_horizontal: 1024,
        max_rez_vertical: 4000,
        max_rez_horizontal: 4000,
        variant_resolutions: JSON.stringify(pimVariantResolutions),
        global_background: JSON.stringify({ r: 0, g: 0, b: 0, alpha: 1 }),
        resource_types: JSON.stringify(['product']),
        created_by: 'a6516da4-b7ba-4b74-a953-0308d3c8f90d',
        modified_by: 'a6516da4-b7ba-4b74-a953-0308d3c8f90d'
      },
      {
        id: 'cms',
        min_rez_vertical: 768,
        min_rez_horizontal: 1024,
        max_rez_vertical: 4000,
        max_rez_horizontal: 4000,
        variant_resolutions: JSON.stringify(cmsVariantResolutions),
        global_background: JSON.stringify({ r: 0, g: 0, b: 0, alpha: 1 }),
        resource_types: JSON.stringify(['banner', 'page', 'block']),
        created_by: 'a6516da4-b7ba-4b74-a953-0308d3c8f90d',
        modified_by: 'a6516da4-b7ba-4b74-a953-0308d3c8f90d'
      }
    ];
    return queryInterface.bulkInsert('config', whatToInsert);
  }),

  down: queryInterface => queryInterface.sequelize.transaction(async t => {
    const whatToDelete = ['dam', 'cms', 'pim'];
    return queryInterface.bulkDelete('config', { id: whatToDelete });
  })
};